/**
 * Vendor e-sign adapter seam (Phase 5).
 * Native accept/ack remains the default; wire a provider behind this interface later.
 */

export type ESignParty = "employee" | "organization";

export type ESignEnvelopeRequest = {
  organizationId: string;
  contractId: string;
  documentStorageKey: string;
  employeeEmail: string;
  organizationSignerEmail: string;
  returnUrl: string;
};

export type ESignEnvelopeResult = {
  provider: "native" | "docusign" | "adobe_sign";
  externalEnvelopeId: string | null;
  signingUrl: string | null;
  status: "created" | "sent" | "completed" | "declined" | "error";
  message: string;
};

export interface EmploymentContractESignAdapter {
  createEnvelope(request: ESignEnvelopeRequest): Promise<ESignEnvelopeResult>;
}

/** Default adapter — keeps signing inside Q-NXUS (native accept). */
export class NativeEmploymentContractESignAdapter
  implements EmploymentContractESignAdapter
{
  async createEnvelope(
    request: ESignEnvelopeRequest,
  ): Promise<ESignEnvelopeResult> {
    return {
      provider: "native",
      externalEnvelopeId: null,
      signingUrl: `/people/employees/contracts/${request.contractId}`,
      status: "created",
      message:
        "Use native employee/organization acceptance on the contract detail page.",
    };
  }
}

let activeAdapter: EmploymentContractESignAdapter =
  new NativeEmploymentContractESignAdapter();

export function getEmploymentContractESignAdapter(): EmploymentContractESignAdapter {
  return activeAdapter;
}

/** Test / future provider injection. */
export function setEmploymentContractESignAdapter(
  adapter: EmploymentContractESignAdapter,
): void {
  activeAdapter = adapter;
}
