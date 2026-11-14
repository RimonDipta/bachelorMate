import { labelMap, translate } from "../i18n";
import { Wifi, Utensils, Snowflake, Bath, Sun, Sofa, Zap, ArrowUpDown, Flame, Droplets, Shirt, Car, ShieldCheck, Sparkles } from "lucide-react";

const AMENITY_ICONS = {
  wifi: Wifi, meals: Utensils, ac: Snowflake, attached_bath: Bath, balcony: Sun, furnished: Sofa, generator: Zap,
  lift: ArrowUpDown, gas: Flame, water_filter: Droplets, laundry: Shirt, parking: Car, security: ShieldCheck, cleaner: Sparkles,
};
// { wifi: { label, icon } } with the label read in the current language.
export const AMENITIES = Object.fromEntries(
  Object.entries(AMENITY_ICONS).map(([k, icon]) => [k, Object.defineProperty({ icon }, "label", { enumerable: true, get: () => translate(`listing.amenities.${k}`) })])
);

export const ROOM_TYPES = labelMap("listing.roomTypes", ["shared_room", "single_room", "bed_space"]);
export const GENDER = labelMap("listing.gender", ["any", "male", "female"]);
export const OCCUPATION = labelMap("listing.occupation", ["any", "student", "professional"]);
export const ROOMMATE_TAGS = labelMap("listing.tags", ["clean", "respectful", "pays_on_time", "quiet", "friendly", "helpful", "cooks_well", "messy", "noisy", "late_payments"]);
export const NEGATIVE_TAGS = new Set(["messy", "noisy", "late_payments"]);
