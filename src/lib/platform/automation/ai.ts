/**
 * Future AI integration — platform-level contracts.
 * No AI implementation; architecture only.
 */

export interface AiServiceContext {
  schoolId: string;
  module: string;
  entityType: string;
  entityId: string;
}

export interface ApplicationSummaryRequest extends AiServiceContext {
  applicationId: string;
}

export interface DecisionRecommendationRequest extends AiServiceContext {
  applicationId: string;
}

export interface RiskAssessmentRequest extends AiServiceContext {
  applicationId: string;
}

export interface EnrollmentPredictionRequest extends AiServiceContext {
  leadId: string;
}

export interface FundingRecommendationRequest extends AiServiceContext {
  applicationId: string;
  stateCode?: string;
}

export interface CommunicationDraftRequest extends AiServiceContext {
  templateKey: string;
  tone?: "formal" | "warm" | "urgent";
}

export const PlatformAiService = {
  async summarizeApplication(_req: ApplicationSummaryRequest) {
    return null;
  },
  async recommendDecision(_req: DecisionRecommendationRequest) {
    return null;
  },
  async detectRisk(_req: RiskAssessmentRequest) {
    return null;
  },
  async predictEnrollment(_req: EnrollmentPredictionRequest) {
    return null;
  },
  async recommendFunding(_req: FundingRecommendationRequest) {
    return null;
  },
  async draftCommunication(_req: CommunicationDraftRequest) {
    return null;
  },
};
