import { type Dispatch, type SetStateAction, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import {
  parseMoneyToPaise,
  textFromPaise,
} from "../../commission/utils/commissionFormatting";
import { humanize, inputClass, rewardTypes } from "../utils/campaignFormHelpers";
import { Field } from "./CampaignFormField";
import type {
  InfluencerCampaign,
  InfluencerCampaignEligibilityRule,
  InfluencerCampaignObjective,
  InfluencerCampaignPayload,
  InfluencerCampaignReward,
  InfluencerCampaignRewardType,
} from "../types/influencerCampaign.types";

const textareaClass =
  "min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

const objectives: InfluencerCampaignObjective[] = [
  "AWARENESS",
  "BOOKING_GROWTH",
  "RETENTION",
  "VENDOR_PROMOTION",
];

const eligibilityRuleTypes: InfluencerCampaignEligibilityRule["ruleType"][] = [
  "APPROVED_INFLUENCER",
  "CITY",
  "CATEGORY",
  "MIN_FOLLOWERS",
  "MIN_REELS",
  "INVITED_INFLUENCER",
];

function dateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function fromDateInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function eligibilityValueText(rule: InfluencerCampaignEligibilityRule) {
  if (rule.ruleType === "CITY") {
    return Array.isArray(rule.value.cities) ? rule.value.cities.join(", ") : "";
  }
  if (rule.ruleType === "CATEGORY") {
    return Array.isArray(rule.value.categoryIds)
      ? rule.value.categoryIds.join(", ")
      : "";
  }
  if (rule.ruleType === "INVITED_INFLUENCER") {
    return Array.isArray(rule.value.influencerProfileIds)
      ? rule.value.influencerProfileIds.join(", ")
      : "";
  }
  if (["MIN_FOLLOWERS", "MIN_REELS"].includes(rule.ruleType)) {
    return String(rule.value.minimum ?? "");
  }
  return "";
}

function eligibilityValue(
  ruleType: InfluencerCampaignEligibilityRule["ruleType"],
  rawValue: string,
) {
  const list = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (ruleType === "CITY") return { cities: list };
  if (ruleType === "CATEGORY") return { categoryIds: list };
  if (ruleType === "INVITED_INFLUENCER") {
    return { influencerProfileIds: list };
  }
  if (["MIN_FOLLOWERS", "MIN_REELS"].includes(ruleType)) {
    return { minimum: Math.max(0, Number(rawValue) || 0) };
  }
  return {};
}

function eligibilityValueLabel(
  ruleType: InfluencerCampaignEligibilityRule["ruleType"],
) {
  if (ruleType === "CITY") return "Cities (comma separated)";
  if (ruleType === "CATEGORY") return "Category IDs (comma separated)";
  if (ruleType === "INVITED_INFLUENCER") {
    return "Influencer profile IDs (comma separated)";
  }
  if (ruleType === "MIN_FOLLOWERS") return "Minimum followers";
  if (ruleType === "MIN_REELS") return "Minimum reels";
  return null;
}

interface InfluencerCampaignFormModalProps {
  editing: InfluencerCampaign | null;
  form: InfluencerCampaignPayload;
  setForm: Dispatch<SetStateAction<InfluencerCampaignPayload>>;
  contentJson: string;
  setContentJson: (value: string) => void;
  visibilityJson: string;
  setVisibilityJson: (value: string) => void;
  updateReward: (
    index: number,
    patch: Partial<Omit<InfluencerCampaignReward, "rewardId">>,
  ) => void;
  updateEligibilityRule: (
    index: number,
    patch: Partial<Omit<InfluencerCampaignEligibilityRule, "ruleId">>,
  ) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export function InfluencerCampaignFormModal({
  editing,
  form,
  setForm,
  contentJson,
  setContentJson,
  visibilityJson,
  setVisibilityJson,
  updateReward,
  updateEligibilityRule,
  isSubmitting,
  onSubmit,
  onClose,
}: InfluencerCampaignFormModalProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [budgetText, setBudgetText] = useState(() => textFromPaise(form.budgetPaise));
  const [rewardAmountTexts, setRewardAmountTexts] = useState<Record<number, string>>(
    {},
  );

  const rewardAmountText = (index: number, amountPaise: number | null | undefined) =>
    rewardAmountTexts[index] ?? textFromPaise(amountPaise ?? 0);

  return (
    <Modal
      title={editing ? `Edit ${editing.publicCampaignId}` : "New influencer campaign"}
      description="Campaigns must pass review before creators can see them."
      size="xl"
      closeDisabled={isSubmitting}
      onClose={onClose}
      footer={
        <>
          <Button disabled={isSubmitting} variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button isLoading={isSubmitting} onClick={onSubmit}>
            {editing ? "Save campaign" : "Create draft"}
          </Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </Field>
          <Field label="Objective">
            <select
              className={inputClass}
              value={form.objective}
              onChange={(event) =>
                setForm({
                  ...form,
                  objective: event.target.value as InfluencerCampaignObjective,
                })
              }
            >
              {objectives.map((objective) => (
                <option key={objective} value={objective}>
                  {humanize(objective)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Summary">
            <input
              className={inputClass}
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
            />
          </Field>
          <Field label="Budget (₹)">
            <input
              className={inputClass}
              inputMode="decimal"
              value={budgetText}
              onChange={(event) => {
                const next = event.target.value;
                setBudgetText(next);
                try {
                  setForm({ ...form, budgetPaise: parseMoneyToPaise(next, "Budget") });
                } catch {
                  // leave budgetPaise unchanged until the text is a valid amount again
                }
              }}
            />
          </Field>
          <Field label="Max participants">
            <input
              className={inputClass}
              type="number"
              value={form.maxParticipants ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  maxParticipants: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
            />
          </Field>
          <Field label="Starts at">
            <input
              className={inputClass}
              type="datetime-local"
              value={dateInput(form.startsAt)}
              onChange={(event) =>
                setForm({ ...form, startsAt: fromDateInput(event.target.value) })
              }
            />
          </Field>
          <Field label="Ends at">
            <input
              className={inputClass}
              type="datetime-local"
              value={dateInput(form.endsAt)}
              onChange={(event) =>
                setForm({ ...form, endsAt: fromDateInput(event.target.value) })
              }
            />
          </Field>
          <Field label="Submission deadline">
            <input
              className={inputClass}
              type="datetime-local"
              value={dateInput(form.submissionDeadlineAt)}
              onChange={(event) =>
                setForm({
                  ...form,
                  submissionDeadlineAt: fromDateInput(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Reward summary">
            <input
              className={inputClass}
              value={form.rewardSummary}
              onChange={(event) =>
                setForm({ ...form, rewardSummary: event.target.value })
              }
            />
          </Field>
          <Field label="Eligibility summary">
            <input
              className={inputClass}
              value={form.eligibilitySummary}
              onChange={(event) =>
                setForm({ ...form, eligibilitySummary: event.target.value })
              }
            />
          </Field>
          <Field label="Reason">
            <input
              className={inputClass}
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
          </Field>
          <Field label="Brief">
            <textarea
              className={textareaClass}
              value={form.brief}
              onChange={(event) => setForm({ ...form, brief: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">Reward rules</h3>
                <p className="text-xs text-muted">
                  Define at least one reward before review.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    rewards: [
                      ...current.rewards,
                      {
                        rewardType: "CASH",
                        title: `Reward ${current.rewards.length + 1}`,
                        amountPaise: 100000,
                        metadata: {},
                      },
                    ],
                  }))
                }
              >
                Add reward
              </Button>
            </div>
            <div className="grid gap-3">
              {form.rewards.map((reward, index) => (
                <div
                  className="grid gap-3 rounded-lg bg-surface-subtle p-3 sm:grid-cols-2"
                  key={`reward-${index}`}
                >
                  <Field label="Reward type">
                    <select
                      className={inputClass}
                      value={reward.rewardType}
                      onChange={(event) =>
                        updateReward(index, {
                          rewardType: event.target
                            .value as InfluencerCampaignRewardType,
                        })
                      }
                    >
                      {rewardTypes
                        .filter((type) => type !== "ALL")
                        .map((type) => (
                          <option key={type} value={type}>
                            {humanize(type)}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Title">
                    <input
                      className={inputClass}
                      value={reward.title}
                      onChange={(event) =>
                        updateReward(index, { title: event.target.value })
                      }
                    />
                  </Field>
                  {reward.rewardType === "CASH" ? (
                    <Field label="Amount (₹)">
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={rewardAmountText(index, reward.amountPaise)}
                        onChange={(event) => {
                          const next = event.target.value;
                          setRewardAmountTexts((prev) => ({
                            ...prev,
                            [index]: next,
                          }));
                          try {
                            updateReward(index, {
                              amountPaise: parseMoneyToPaise(next, "Amount"),
                            });
                          } catch {
                            // leave amountPaise unchanged until the text is valid again
                          }
                        }}
                      />
                    </Field>
                  ) : null}
                  <Field label="Rank from">
                    <input
                      className={inputClass}
                      min={1}
                      type="number"
                      value={reward.rankFrom ?? ""}
                      onChange={(event) =>
                        updateReward(index, {
                          rankFrom: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                    />
                  </Field>
                  <Field label="Rank to">
                    <input
                      className={inputClass}
                      min={1}
                      type="number"
                      value={reward.rankTo ?? ""}
                      onChange={(event) =>
                        updateReward(index, {
                          rankTo: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                    />
                  </Field>
                  <Field label="Max winners">
                    <input
                      className={inputClass}
                      min={1}
                      type="number"
                      value={reward.maxWinners ?? ""}
                      onChange={(event) =>
                        updateReward(index, {
                          maxWinners: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                    />
                  </Field>
                  <div className="flex items-end justify-end sm:col-span-2">
                    <Button
                      disabled={form.rewards.length === 1}
                      variant="ghost"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          rewards: current.rewards.filter(
                            (_item, rewardIndex) => rewardIndex !== index,
                          ),
                        }))
                      }
                    >
                      Remove reward
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-medium">Eligibility rules</h3>
                <p className="text-xs text-muted">
                  Required rules limit who can join this campaign.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    eligibilityRules: [
                      ...current.eligibilityRules,
                      {
                        ruleType: "CITY",
                        value: { cities: [] },
                        description: "Eligible service cities.",
                        isRequired: true,
                        displayOrder: current.eligibilityRules.length + 1,
                      },
                    ],
                  }))
                }
              >
                Add rule
              </Button>
            </div>
            <div className="grid gap-3">
              {form.eligibilityRules.map((rule, index) => {
                const valueLabel = eligibilityValueLabel(rule.ruleType);
                return (
                  <div
                    className="grid gap-3 rounded-lg bg-surface-subtle p-3"
                    key={`eligibility-${index}`}
                  >
                    <Field label="Rule type">
                      <select
                        className={inputClass}
                        value={rule.ruleType}
                        onChange={(event) => {
                          const ruleType = event.target
                            .value as InfluencerCampaignEligibilityRule["ruleType"];
                          updateEligibilityRule(index, {
                            ruleType,
                            value: eligibilityValue(ruleType, ""),
                          });
                        }}
                      >
                        {eligibilityRuleTypes.map((type) => (
                          <option key={type} value={type}>
                            {humanize(type)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {valueLabel ? (
                      <Field label={valueLabel}>
                        <input
                          className={inputClass}
                          type={
                            ["MIN_FOLLOWERS", "MIN_REELS"].includes(rule.ruleType)
                              ? "number"
                              : "text"
                          }
                          value={eligibilityValueText(rule)}
                          onChange={(event) =>
                            updateEligibilityRule(index, {
                              value: eligibilityValue(
                                rule.ruleType,
                                event.target.value,
                              ),
                            })
                          }
                        />
                      </Field>
                    ) : null}
                    <Field label="Description">
                      <input
                        className={inputClass}
                        value={rule.description ?? ""}
                        onChange={(event) =>
                          updateEligibilityRule(index, {
                            description: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        checked={rule.isRequired}
                        type="checkbox"
                        onChange={(event) =>
                          updateEligibilityRule(index, {
                            isRequired: event.target.checked,
                          })
                        }
                      />
                      Required rule
                    </label>
                    <div className="flex justify-end">
                      <Button
                        disabled={form.eligibilityRules.length === 1}
                        variant="ghost"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            eligibilityRules: current.eligibilityRules.filter(
                              (_item, ruleIndex) => ruleIndex !== index,
                            ),
                          }))
                        }
                      >
                        Remove rule
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <button
            className="text-xs font-semibold text-primary"
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
          >
            {showAdvanced ? "Hide advanced" : "Show advanced"}
          </button>
          {showAdvanced ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <Field label="Content requirements JSON">
                <textarea
                  className={textareaClass}
                  value={contentJson}
                  onChange={(event) => setContentJson(event.target.value)}
                />
              </Field>
              <Field label="Visibility rules JSON">
                <textarea
                  className={textareaClass}
                  value={visibilityJson}
                  onChange={(event) => setVisibilityJson(event.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
