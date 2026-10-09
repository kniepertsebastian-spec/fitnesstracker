import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { activityLevelSchema, genderSchema, nutritionGoalSchema } from "@fitnesstracker/shared";
import {
  ACTIVITY_LEVEL_LABELS,
  GENDER_LABELS,
  NUTRITION_GOAL_LABELS,
  useProfile,
  useUpsertProfile,
} from "../../hooks/useProfile";

const formSchema = z.object({
  weightKg: z.coerce.number().positive(),
  heightCm: z.coerce.number().int().positive(),
  age: z.coerce.number().int().positive(),
  gender: genderSchema,
  activityLevel: activityLevelSchema,
  goal: nutritionGoalSchema,
});
type FormValues = z.infer<typeof formSchema>;

export function ProfileForm() {
  const { data: profile, isLoading } = useProfile();
  const upsertProfile = useUpsertProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { gender: "MALE", activityLevel: "MODERATE", goal: "MAINTAIN" },
  });

  useEffect(() => {
    if (profile) {
      reset({
        weightKg: profile.weightKg,
        heightCm: profile.heightCm,
        age: profile.age,
        gender: profile.gender,
        activityLevel: profile.activityLevel,
        goal: profile.goal,
      });
    }
  }, [profile, reset]);

  const onSubmit = (data: FormValues) => {
    upsertProfile.mutate(data);
  };

  if (isLoading) {
    return <p className="text-text-faint">Lädt…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-text-subtle">Gewicht (kg)</label>
            <input
              type="number"
              step="0.1"
              className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
              {...register("weightKg")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-subtle">Größe (cm)</label>
            <input
              type="number"
              className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
              {...register("heightCm")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-subtle">Alter</label>
            <input
              type="number"
              className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
              {...register("age")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-subtle">Geschlecht</label>
            <select
              className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
              {...register("gender")}
            >
              {genderSchema.options.map((value) => (
                <option key={value} value={value}>
                  {GENDER_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-text-subtle">Aktivitätslevel</label>
          <select
            className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
            {...register("activityLevel")}
          >
            {activityLevelSchema.options.map((value) => (
              <option key={value} value={value}>
                {ACTIVITY_LEVEL_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-text-subtle">Ziel</label>
          <select
            className="w-full rounded-lg border border-border-strong bg-bg px-3 py-2"
            {...register("goal")}
          >
            {nutritionGoalSchema.options.map((value) => (
              <option key={value} value={value}>
                {NUTRITION_GOAL_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 rounded-lg bg-accent py-2 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          Speichern
        </button>
      </form>

      {profile && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-text-faint">Tagesbedarf</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-text-faint">Grundumsatz (BMR)</p>
              <p className="text-lg font-semibold text-text-2">{profile.bmr} kcal</p>
            </div>
            <div>
              <p className="text-text-faint">Gesamtumsatz (TDEE)</p>
              <p className="text-lg font-semibold text-text-2">{profile.tdee} kcal</p>
            </div>
            <div>
              <p className="text-text-faint">Ziel-Kalorien</p>
              <p className="text-lg font-semibold text-accent">{profile.targetCalories} kcal</p>
            </div>
            <div>
              <p className="text-text-faint">Ziel-Protein</p>
              <p className="text-lg font-semibold text-accent">{profile.targetProteinG} g</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
