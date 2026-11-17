import bcrypt from "bcryptjs";
import { RpgServiceBase, publicUser, roleOf } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

const STATUSES = new Set(["PENDING", "ACTIVE", "INACTIVE"]);

export class CampaignMemberService extends RpgServiceBase {
  async join(actor, campaignId, password) {
    this.requireRole(actor, "PLAYER");
    const campaign = await this.requireRecord("campaigns", campaignId, "Campanha não encontrada.");
    if (typeof password !== "string" || !(await bcrypt.compare(password, campaign.passwordHash))) {
      throw new RpgServiceError(403, "Senha de campanha inválida.");
    }
    const existing = (await this.repository.list("campaign_members", (member) => (
      member.campaignId === campaignId && member.userId === actor.id
    )))[0];
    if (existing) {
      if (existing.status === "ACTIVE") {
        return existing;
      }
      if (existing.status === "PENDING") {
        return this.repository.update("campaign_members", existing.id, { status: "ACTIVE" });
      }
      throw new RpgServiceError(403, "Sua participação nesta campanha está inativa.");
    }
    await this.repository.create("campaign_members", {
      campaignId, userId: actor.id, joinedAt: new Date().toISOString(), status: "ACTIVE",
    });
    return { campaignId, userId: actor.id, status: "ACTIVE" };
  }

  async list(actor, campaignId) {
    await this.requireCampaignGM(actor, campaignId);
    const memberships = await this.repository.list(
      "campaign_members",
      (member) => member.campaignId === campaignId,
    );
    const users = await this.repository.list("users");
    const usersById = new Map(users.map((user) => [user.id, publicUser(user)]));
    return memberships.map((member) => ({ ...member, user: usersById.get(member.userId) ?? null }));
  }

  async add(actor, campaignId, { userId, status = "PENDING" }) {
    await this.requireCampaignGM(actor, campaignId);
    if (typeof userId !== "string" || !STATUSES.has(status)) {
      throw new RpgServiceError(400, "Usuário ou situação de participação inválidos.");
    }
    const user = await this.requireRecord("users", userId, "Usuário não encontrado.");
    if (roleOf(user) !== "PLAYER") {
      throw new RpgServiceError(400, "Somente usuários PLAYER podem participar de campanhas.");
    }
    if ((await this.repository.list("campaign_members", (member) => (
      member.campaignId === campaignId && member.userId === userId
    ))).length) {
      throw new RpgServiceError(409, "O usuário já possui participação nesta campanha.");
    }
    return this.repository.create("campaign_members", {
      campaignId, userId, status, joinedAt: new Date().toISOString(),
    });
  }

  async update(actor, campaignId, userId, { status }) {
    await this.requireCampaignGM(actor, campaignId);
    if (!STATUSES.has(status)) {
      throw new RpgServiceError(400, "Situação de participação inválida.");
    }
    const member = (await this.repository.list("campaign_members", (item) => (
      item.campaignId === campaignId && item.userId === userId
    )))[0];
    if (!member) {
      throw new RpgServiceError(404, "Participação não encontrada.");
    }
    return this.repository.update("campaign_members", member.id, { status });
  }

  async remove(actor, campaignId, userId) {
    await this.requireCampaignGM(actor, campaignId);
    const member = (await this.repository.list("campaign_members", (item) => (
      item.campaignId === campaignId && item.userId === userId
    )))[0];
    if (!member) {
      throw new RpgServiceError(404, "Participação não encontrada.");
    }
    await this.repository.delete("campaign_members", member.id);
    return { deleted: true };
  }
}
