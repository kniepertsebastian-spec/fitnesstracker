import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { activityLevelSchema, genderSchema, nutritionGoalSchema } from "@fitnesstracker/shared";
import { AppShell } from "../components/layout/AppShell";
import { WaterCard } from "../components/nutrition/WaterCard";
import { NUTRITION_TIPS } from "../data/nutritionTips";
import {
  ACTIVITY_LEVEL_LABELS,
  GENDER_LABELS,
  NUTRITION_GOAL_LABELS,
  useProfile,
  useUpsertProfile,
} from "../hooks/useProfile";

const formSchema = z.object({
  weightKg: z.coerce.number().positive(),
  heightCm: z.coerce.number().int().positive(),
  age: z.coerce.number().int().positive(),
  gender: genderSchema,
  activityLevel: activityLevelSchema,
  goal: nutritionGoalSchema,
});
type FormValues = z.infer<typeof formSchema>;

export function NutritionPage() {
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

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">Ernährung</h1>

      <div className="mb-4">
        <WaterCard />
      </div>

      {isLoading ? (
        <p className="text-slate-500">Lädt…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-400">Gewicht (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  {...register("weightKg")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">Größe (cm)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  {...register("heightCm")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">Alter</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  {...register("age")}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-400">Geschlecht</label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
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
              <label className="mb-1 block text-sm text-slate-400">Aktivitätslevel</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
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
              <label className="mb-1 block text-sm text-slate-400">Ziel</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
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
              className="mt-2 rounded-lg bg-sky-500 py-2 font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              Speichern
            </button>
          </form>

          {profile && (
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm text-slate-500">Tagesbedarf</p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Grundumsatz (BMR)</p>
                  <p className="text-lg font-semibold text-slate-200">{profile.bmr} kcal</p>
                </div>
                <div>
                  <p className="text-slate-500">Gesamtumsatz (TDEE)</p>
                  <p className="text-lg font-semibold text-slate-200">{profile.tdee} kcal</p>
                </div>
                <div>
                  <p className="text-slate-500">Ziel-Kalorien</p>
                  <p className="text-lg font-semibold text-sky-400">{profile.targetCalories} kcal</p>
                </div>
                <div>
                  <p className="text-slate-500">Ziel-Protein</p>
                  <p className="text-lg font-semibold text-sky-400">{profile.targetProteinG} g</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-medium text-slate-400">Tipps & Tricks</h2>
            <ul className="flex flex-col gap-2">
              {NUTRITION_TIPS.map((tip) => (
                <li
                  key={tip}
                  className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </AppShell>
  );
}
