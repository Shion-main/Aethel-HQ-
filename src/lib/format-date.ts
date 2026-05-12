const PH_TIME_ZONE = "Asia/Manila";

export const formatPHDateTime = (value: string | Date): string => {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", {
    timeZone: PH_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const formatPHDate = (value: string | Date): string => {
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-PH", {
    timeZone: PH_TIME_ZONE,
    dateStyle: "medium",
  });
};
