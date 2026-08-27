import { ensureUser, getDatabase, getMembership, getRequestUser, jsonError, loadSnapshot, touchMembership, unauthorized } from "../../../_shared/server";

type RouteContext = { params: Promise<{ tripId: string }> };
type AssignmentDecision = "accept" | "decline";

export async function POST(request: Request, context: RouteContext) {
  const user = getRequestUser(request);
  if (!user) return unauthorized();
  const { tripId } = await context.params;
  const db = getDatabase();
  await ensureUser(db, user);
  const membership = await getMembership(db, tripId, user.userId);
  if (!membership) return jsonError("你不是该队伍成员", 403);

  const body = await request.json().catch(() => null) as {
    proposalId?: unknown;
    itemId?: unknown;
    afterMessageId?: unknown;
    decision?: unknown;
  } | null;
  const proposalId = typeof body?.proposalId === "string" ? body.proposalId : "";
  const itemId = Number(body?.itemId);
  const afterMessageId = Number(body?.afterMessageId);
  const decision = body?.decision as AssignmentDecision | undefined;
  if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isInteger(afterMessageId) || (decision !== "accept" && decision !== "decline")) {
    return jsonError("分工确认请求格式不正确");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await loadSnapshot(db, tripId);
    if (!current) return jsonError("队伍数据不存在", 404);
    const proposal = current.state.assignmentProposals.find((entry) =>
      (proposalId ? entry.id === proposalId : true)
      && entry.itemId === itemId
      && entry.afterMessageId === afterMessageId
      && entry.target === membership.slotName,
    );
    if (!proposal) return jsonError("这项分工已处理，请刷新后查看", 409);
    const item = current.state.items.find((entry) => entry.id === itemId);
    if (!item) return jsonError("物品不存在", 404);

    if (decision === "accept" && !item.owners.includes(membership.slotName)) {
      item.owners = [...item.owners, membership.slotName];
    }
    current.state.assignmentProposals = current.state.assignmentProposals.filter((entry) => entry !== proposal);

    const updated = await db.prepare("UPDATE trips SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND version = ? RETURNING version")
      .bind(tripId, current.version).first<{ version: number }>();
    if (!updated) continue;

    const statements = [
      db.prepare("UPDATE trip_snapshots SET state_json = ?, version = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE trip_id = ?")
        .bind(JSON.stringify(current.state), updated.version, user.userId, tripId),
      proposalId
        ? db.prepare("DELETE FROM assignment_proposals WHERE trip_id = ? AND id = ?").bind(tripId, proposalId)
        : db.prepare("DELETE FROM assignment_proposals WHERE trip_id = ? AND item_client_id = ? AND message_id = ? AND target_slot = ?")
            .bind(tripId, itemId, String(afterMessageId), membership.slotName),
      db.prepare("UPDATE trip_members SET last_seen_at = CURRENT_TIMESTAMP WHERE trip_id = ? AND user_id = ?")
        .bind(tripId, user.userId),
      db.prepare("INSERT INTO trip_events (trip_id, actor_id, event_type, version) VALUES (?, ?, 'assignment_resolved', ?)")
        .bind(tripId, user.userId, updated.version),
    ];
    if (decision === "accept") {
      statements.push(db.prepare(`INSERT INTO item_owners (item_id, trip_id, member_slot, checked, updated_at)
        VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(item_id, member_slot) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`)
        .bind(`${tripId}:${itemId}`, tripId, membership.slotName));
    }
    await db.batch(statements);
    await touchMembership(db, tripId, user.userId);
    return Response.json({ ok: true, version: updated.version, itemId, decision, member: membership.slotName });
  }

  return jsonError("队伍刚刚有更新，请再试一次", 409);
}
