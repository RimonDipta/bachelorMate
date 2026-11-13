import { Wifi, Utensils, Snowflake, Bath, Sun, Sofa, Zap, ArrowUpDown, Flame, Droplets, Shirt, Car, ShieldCheck, Sparkles } from "lucide-react";

export const AMENITIES = {
  wifi: { label: "Wi-Fi", icon: Wifi },
  meals: { label: "Meals", icon: Utensils },
  ac: { label: "AC", icon: Snowflake },
  attached_bath: { label: "Attached bath", icon: Bath },
  balcony: { label: "Balcony", icon: Sun },
  furnished: { label: "Furnished", icon: Sofa },
  generator: { label: "Generator / IPS", icon: Zap },
  lift: { label: "Lift", icon: ArrowUpDown },
  gas: { label: "Gas line", icon: Flame },
  water_filter: { label: "Filtered water", icon: Droplets },
  laundry: { label: "Laundry", icon: Shirt },
  parking: { label: "Parking", icon: Car },
  security: { label: "Security", icon: ShieldCheck },
  cleaner: { label: "Cleaner", icon: Sparkles },
};

export const ROOM_TYPES = { shared_room: "Shared room", single_room: "Single room", bed_space: "Bed space" };
export const GENDER = { any: "Anyone", male: "Male only", female: "Female only" };
export const OCCUPATION = { any: "Students & professionals", student: "Students", professional: "Professionals" };
export const ROOMMATE_TAGS = {
  clean: "Clean",
  respectful: "Respectful",
  pays_on_time: "Pays on time",
  quiet: "Quiet",
  friendly: "Friendly",
  helpful: "Helpful",
  cooks_well: "Cooks well",
  messy: "Messy",
  noisy: "Noisy",
  late_payments: "Late payments",
};
export const NEGATIVE_TAGS = new Set(["messy", "noisy", "late_payments"]);
