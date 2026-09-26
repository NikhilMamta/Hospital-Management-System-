import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPatientCardNurses } from "../api/patientProfile";

/** Shift label for the current local time (same rule PatientCard has always used). */
export const getCurrentShiftLabel = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 8 && hour < 14) return "Shift A";
  if (hour >= 14 && hour < 20) return "Shift B";
  return "Shift C";
};

/** The id a PatientCard looks nurses up by. */
export const getPatientCardIpd = (patient) =>
  patient?.ipd_number || patient?.admission_no || "";

/**
 * Loads the nurses for every card currently on screen with ONE request,
 * instead of one request per PatientCard.
 *
 * @param {Array} patients - the patients whose cards are visible
 * @returns {Record<string, string[]> | undefined} IPD number -> nurse names
 *   (undefined while loading, so cards can show their empty state)
 */
export default function usePatientCardNurses(patients) {
  const ipdNumbers = useMemo(
    () => [...new Set((patients || []).map(getPatientCardIpd).filter(Boolean))],
    [patients],
  );
  const shift = getCurrentShiftLabel();

  const { data } = useQuery({
    queryKey: ["patient-card-nurses", shift, ipdNumbers],
    queryFn: () => getPatientCardNurses(ipdNumbers, shift),
    enabled: ipdNumbers.length > 0,
    staleTime: 60 * 1000,
  });

  return data;
}
