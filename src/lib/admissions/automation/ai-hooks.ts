/**
 * Future AI integration hooks — architecture only, no AI implementation.
 * These interfaces define the contract for later AI services.
 */

export interface ApplicationSummaryInput {
  leadId: string;
  applicationId: string;
}

export interface ApplicationSummaryResult {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendedNextSteps: string[];
}

export interface DecisionRecommendationInput {
  leadId: string;
  applicationId: string;
}

export interface DecisionRecommendationResult {
  recommendation: "accept" | "waitlist" | "deny" | "request_info";
  confidence: number;
  rationale: string;
}

export interface MissingDocumentsInput {
  applicationId: string;
}

export interface MissingDocumentsResult {
  missingDocuments: string[];
  suggestedMessage: string;
}

export interface ApplicationRiskInput {
  leadId: string;
  applicationId: string;
}

export interface ApplicationRiskResult {
  riskLevel: "low" | "medium" | "high";
  factors: string[];
}

export interface PersonalizedCommunicationInput {
  leadId: string;
  templateKey: string;
  tone?: "formal" | "warm" | "urgent";
}

export interface PersonalizedCommunicationResult {
  subject: string;
  body: string;
}

export interface EnrollmentProbabilityInput {
  leadId: string;
}

export interface EnrollmentProbabilityResult {
  probability: number;
  factors: string[];
}

export interface ScholarshipRecommendationInput {
  applicationId: string;
  householdIncome?: number | null;
}

export interface ScholarshipRecommendationResult {
  recommendedPrograms: string[];
  estimatedAward: number | null;
}

export interface FundingEligibilityInput {
  applicationId: string;
  stateCode: string;
}

export interface FundingEligibilityResult {
  eligiblePrograms: string[];
  estimatedAward: number | null;
  requiredDocuments: string[];
}

/** Placeholder service — implement when AI module is added */
export const AdmissionsAiService = {
  async summarizeApplication(
    _input: ApplicationSummaryInput
  ): Promise<ApplicationSummaryResult | null> {
    return null;
  },
  async recommendDecision(
    _input: DecisionRecommendationInput
  ): Promise<DecisionRecommendationResult | null> {
    return null;
  },
  async identifyMissingDocuments(
    _input: MissingDocumentsInput
  ): Promise<MissingDocumentsResult | null> {
    return null;
  },
  async assessApplicationRisk(
    _input: ApplicationRiskInput
  ): Promise<ApplicationRiskResult | null> {
    return null;
  },
  async generatePersonalizedCommunication(
    _input: PersonalizedCommunicationInput
  ): Promise<PersonalizedCommunicationResult | null> {
    return null;
  },
  async predictEnrollmentProbability(
    _input: EnrollmentProbabilityInput
  ): Promise<EnrollmentProbabilityResult | null> {
    return null;
  },
  async recommendScholarships(
    _input: ScholarshipRecommendationInput
  ): Promise<ScholarshipRecommendationResult | null> {
    return null;
  },
  async estimateFundingEligibility(
    _input: FundingEligibilityInput
  ): Promise<FundingEligibilityResult | null> {
    return null;
  },
};
