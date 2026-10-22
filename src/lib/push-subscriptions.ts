import { apiFetchServer } from "@/lib/api-client";
import type { PushSubscription } from "@/lib/database.types";

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
};

type SubscriptionsResponse = {
  subscriptions: PushSubscription[];
};

function subscribeBody(subscription: PushSubscriptionInput) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    userAgent: subscription.userAgent ?? null,
  };
}

/** BE upserts the endpoint for every company in one call. */
export async function upsertPushSubscriptionForAllCompanies(
  subscription: PushSubscriptionInput
) {
  const res = await apiFetchServer<{ ok: boolean }>("/api/push/subscribe", {
    method: "POST",
    body: subscribeBody(subscription),
  });
  if (!res.ok) {
    throw new Error(res.error ?? "Gagal menyimpan push subscription");
  }
}

export async function upsertPushSubscription(
  _companyId: string,
  subscription: PushSubscriptionInput
) {
  await upsertPushSubscriptionForAllCompanies(subscription);
}

export async function deletePushSubscriptionByEndpoint(endpoint: string) {
  const res = await apiFetchServer<{ ok: boolean }>("/api/push/unsubscribe", {
    method: "POST",
    body: { endpoint },
  });
  if (!res.ok) {
    throw new Error(res.error ?? "Gagal menghapus push subscription");
  }
}

export async function deletePushSubscription(
  _companyId: string,
  endpoint: string
) {
  await deletePushSubscriptionByEndpoint(endpoint);
}

export async function fetchPushSubscriptionsByCompany(
  companyId: string
): Promise<PushSubscription[]> {
  const res = await apiFetchServer<SubscriptionsResponse>(
    `/api/push/subscriptions?company_id=${encodeURIComponent(companyId)}`,
    { method: "GET" }
  );
  if (!res.ok) {
    throw new Error(res.error ?? "Gagal memuat push subscriptions");
  }
  return res.data?.subscriptions ?? [];
}
