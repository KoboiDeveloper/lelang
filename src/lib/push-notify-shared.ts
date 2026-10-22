import { apiFetchServer } from "@/lib/api-client";
import { withCompanyQuery } from "@/lib/company-utils";
import {
  deletePushSubscriptionByEndpoint,
  fetchPushSubscriptionsByCompany,
} from "@/lib/push-subscriptions";
import {
  isExpiredPushSubscriptionError,
  sendPushNotification,
  type PushPayload,
} from "@/lib/web-push";

export function verifyPushWebhookSecret(request: Request) {
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("PUSH_WEBHOOK_SECRET belum dikonfigurasi");
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const headerSecret = request.headers.get("x-webhook-secret");

  if (bearerToken !== secret && headerSecret !== secret) {
    return false;
  }

  return true;
}

export async function sendPushToCompany(
  companyId: string,
  companyCode: string,
  payload: PushPayload
) {
  const subscriptions = await fetchPushSubscriptionsByCompany(companyId);

  if (subscriptions.length === 0) {
    return { sent: 0, skipped: true as const, reason: "no_subscribers" as const };
  }

  const targetUrl = payload.url.startsWith("http")
    ? payload.url
    : withCompanyQuery(payload.url, companyCode);

  let sent = 0;

  for (const subscription of subscriptions) {
    try {
      await sendPushNotification(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
        {
          ...payload,
          url: targetUrl,
        }
      );
      sent += 1;
    } catch (error) {
      if (isExpiredPushSubscriptionError(error)) {
        await deletePushSubscriptionByEndpoint(subscription.endpoint);
      } else {
        console.error("[push] gagal kirim ke endpoint:", subscription.endpoint, error);
      }
    }
  }

  return { sent, skipped: false as const };
}

type CompaniesResponse = {
  companies: Array<{ id: string; code: string }>;
};

export async function getCompanyCodeById(companyId: string) {
  const res = await apiFetchServer<CompaniesResponse>("/api/catalog/companies", {
    method: "GET",
  });
  if (!res.ok) {
    throw new Error(res.error ?? "Gagal memuat perusahaan");
  }
  const company = (res.data?.companies ?? []).find((c) => c.id === companyId);
  return company?.code ?? "ams";
}
