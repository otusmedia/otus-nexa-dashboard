/** Dispatched after a CRM appointment is marked done (calendar + pipeline refresh). */
export const CRM_APPOINTMENT_COMPLETED_EVENT = "nxo:crm-appointment-completed";

export function dispatchCrmAppointmentCompleted(appointmentId: string, leadId?: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CRM_APPOINTMENT_COMPLETED_EVENT, {
      detail: { appointmentId, leadId: leadId ?? null },
    }),
  );
}
