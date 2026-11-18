ALTER TABLE fields
    ADD COLUMN IF NOT EXISTS share_with_npcs BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS combats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round >= 1),
    current_turn_index INTEGER NOT NULL DEFAULT 0 CHECK (current_turn_index >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS combatants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combat_id UUID NOT NULL REFERENCES combats(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    is_enemy BOOLEAN NOT NULL DEFAULT FALSE,
    initiative INTEGER NOT NULL DEFAULT 0,
    actions_per_turn INTEGER NOT NULL DEFAULT 1 CHECK (actions_per_turn >= 1)
);

CREATE TABLE IF NOT EXISTS combat_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combat_id UUID NOT NULL REFERENCES combats(id) ON DELETE CASCADE,
    combatant_id UUID NOT NULL REFERENCES combatants(id) ON DELETE CASCADE,
    round INTEGER NOT NULL CHECK (round >= 1),
    description TEXT NOT NULL,
    damage VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS combat_action_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES combat_actions(id) ON DELETE CASCADE,
    combatant_id UUID NOT NULL REFERENCES combatants(id) ON DELETE CASCADE,
    CONSTRAINT uq_combat_action_target UNIQUE (action_id, combatant_id)
);

CREATE TABLE IF NOT EXISTS combatant_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combatant_id UUID NOT NULL REFERENCES combatants(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    CONSTRAINT uq_combatant_field_value UNIQUE (combatant_id, field_id)
);

CREATE TABLE IF NOT EXISTS attacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    damage VARCHAR(255) NOT NULL,
    effects TEXT NOT NULL DEFAULT '',
    observation TEXT NOT NULL DEFAULT '',
    actions_consumed INTEGER NOT NULL DEFAULT 1 CHECK (actions_consumed >= 1),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_combats_campaign_id ON combats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_combatants_combat_id ON combatants(combat_id);
CREATE INDEX IF NOT EXISTS idx_combatants_character_id ON combatants(character_id);
CREATE INDEX IF NOT EXISTS idx_combat_actions_combat_round ON combat_actions(combat_id, round);
CREATE INDEX IF NOT EXISTS idx_combatant_field_values_combatant_id ON combatant_field_values(combatant_id);
CREATE INDEX IF NOT EXISTS idx_attacks_character_id ON attacks(character_id);
