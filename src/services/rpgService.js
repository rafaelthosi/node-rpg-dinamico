import { CampaignMemberService } from "./campaignMemberService.js";
import { CampaignService } from "./campaignService.js";
import { CharacterService } from "./characterService.js";
import { FieldService } from "./fieldService.js";
import { SectionService } from "./sectionService.js";
import { UserService } from "./userService.js";

export { RpgServiceError } from "./rpgServiceError.js";

export class RpgService {
  constructor({ repository }) {
    this.users = new UserService({ repository });
    this.campaigns = new CampaignService({ repository });
    this.members = new CampaignMemberService({ repository });
    this.sections = new SectionService({ repository });
    this.fields = new FieldService({ repository });
    this.characters = new CharacterService({ repository });
  }

  registerPlayer(input) { return this.users.registerPlayer(input); }
  registerGM(input) { return this.users.registerGM(input); }
  listCampaigns(actor) { return this.campaigns.list(actor); }
  createCampaign(actor, input) { return this.campaigns.create(actor, input); }
  getCampaign(actor, campaignId) { return this.campaigns.get(actor, campaignId); }
  updateCampaign(actor, campaignId, input) { return this.campaigns.update(actor, campaignId, input); }
  deleteCampaign(actor, campaignId) { return this.campaigns.delete(actor, campaignId); }
  joinCampaign(actor, campaignId, password) { return this.members.join(actor, campaignId, password); }
  listMembers(actor, campaignId) { return this.members.list(actor, campaignId); }
  addMember(actor, campaignId, input) { return this.members.add(actor, campaignId, input); }
  updateMember(actor, campaignId, userId, input) {
    return this.members.update(actor, campaignId, userId, input);
  }
  removeMember(actor, campaignId, userId) { return this.members.remove(actor, campaignId, userId); }
  listSections(actor, campaignId) { return this.sections.list(actor, campaignId); }
  createSection(actor, campaignId, input) { return this.sections.create(actor, campaignId, input); }
  updateSection(actor, sectionId, input) { return this.sections.update(actor, sectionId, input); }
  deleteSection(actor, sectionId) { return this.sections.delete(actor, sectionId); }
  listFields(actor, sectionId) { return this.fields.list(actor, sectionId); }
  createField(actor, sectionId, input) { return this.fields.create(actor, sectionId, input); }
  updateField(actor, fieldId, input) { return this.fields.update(actor, fieldId, input); }
  deleteField(actor, fieldId) { return this.fields.delete(actor, fieldId); }
  listFieldOptions(actor, fieldId) { return this.fields.listOptions(actor, fieldId); }
  createFieldOption(actor, fieldId, input) { return this.fields.createOption(actor, fieldId, input); }
  updateFieldOption(actor, optionId, input) { return this.fields.updateOption(actor, optionId, input); }
  deleteFieldOption(actor, optionId) { return this.fields.deleteOption(actor, optionId); }
  listCharacters(actor, campaignId) { return this.characters.list(actor, campaignId); }
  createCharacter(actor, campaignId, input) { return this.characters.create(actor, campaignId, input); }
  updateCharacter(actor, characterId, input) { return this.characters.update(actor, characterId, input); }
  deleteCharacter(actor, characterId) { return this.characters.delete(actor, characterId); }
  listFieldValues(actor, characterId) { return this.characters.listValues(actor, characterId); }
  setFieldValue(actor, characterId, fieldId, input) {
    return this.characters.setValue(actor, characterId, fieldId, input);
  }
  deleteFieldValue(actor, characterId, fieldId) {
    return this.characters.deleteValue(actor, characterId, fieldId);
  }
}
