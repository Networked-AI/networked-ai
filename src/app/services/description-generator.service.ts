import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';

export interface GenerateEventDescriptionRequest {
  event: {
    title?: string;
    category?: string;
    location?: string;
    address?: string;
    dates?: Array<{
      start?: string;
      end?: string;
    }>;
  };
  zonedStartTime?: string;
  zonedEndTime?: string;
}

export interface GenerateTicketDescriptionRequest {
  ticketName?: string;
  ticketType?: string;
  price?: string;
  quantity?: number | string;
  eventDate?: string;
  eventStartTime?: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Backend proxy: accepts messages + max_tokens, returns generated content */
interface DescriptionGeneratorResponse {
  success: boolean;
  data?: { description: string };
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class DescriptionGeneratorService extends BaseApiService {

  /**
   * Call backend with messages and max_tokens; backend uses OpenAI and returns content.
   */
  async generateDescription(messages: OpenAIMessage[], maxTokens: number): Promise<string> {
    try {
      const result = await this.post<DescriptionGeneratorResponse>('/open-ai/generate-description', {
        messages,
        max_tokens: maxTokens
      });
      return result?.data?.description ?? '';
    } catch (error: any) {
      console.error('Error generating description:', error);
      throw error;
    }
  }

  /**
   * Generate event description using backend (OpenAI key on server)
   */
  async generateEventDescription(data: GenerateEventDescriptionRequest): Promise<string> {
    try {
      if (!data.event) {
        throw new Error('Event data is required.');
      }

      const { event, zonedStartTime, zonedEndTime } = data;
      const promptParts: string[] = [];

      if (event.title && event.title !== 'TBD') {
        promptParts.push(`title=${event.title}`);
      }
      if (event.category && event.category !== 'TBD') {
        promptParts.push(`category=${event.category}`);
      }
      if (event.location && event.location !== 'TBD') {
        promptParts.push(`venueName=${event.location}`);
      }
      if (event.address && event.address !== 'TBD') {
        promptParts.push(`venueAddress=${event.address}`);
      }
      if (zonedStartTime && zonedStartTime !== 'TBD') {
        promptParts.push(`startTime=${zonedStartTime}`);
      }
      if (zonedEndTime && zonedEndTime !== 'TBD') {
        promptParts.push(`endTime=${zonedEndTime}`);
      }

      const prompt = `Generate a brief description of an event for an online listing based on the following event details: ${promptParts.join('; ')}. If a value is 'TBD', that indicates that that specific parameter has not be defined yet, so leave that event parameter and its value out of the description entirely. Decorate with a couple of related emoji's and make sure it is easy to read, with paragraph breaks between the main sections, and maximizes attendance.`;

      const messages: OpenAIMessage[] = [{ role: 'user', content: prompt }];
      return await this.generateDescription(messages, 4000);
    } catch (error: any) {
      console.error('Error generating event description:', error);
      throw error;
    }
  }

  /**
   * Generate ticket description using backend (OpenAI key on server)
   */
  async generateTicketDescription(data: GenerateTicketDescriptionRequest): Promise<string> {
    try {
      const { ticketName, ticketType, price, quantity, eventDate, eventStartTime } = data;

      const prompt = `Generate a very brief and compelling description (2-3 lines only) for a ${ticketType || 'ticket'}${ticketName ? ` named "${ticketName}"` : ''}${price && price !== '0.00' ? ` priced at $${price}` : ' (Free ticket)'}${quantity ? ` with ${quantity} available tickets` : ''}. Make it concise, engaging, and highlight the key value. Include 1-2 relevant emoji's. Keep it to maximum 3 short lines.`;

      const messages: OpenAIMessage[] = [{ role: 'user', content: prompt }];
      return await this.generateDescription(messages, 150);
    } catch (error: any) {
      console.error('Error generating ticket description:', error);
      throw error;
    }
  }

  /**
   * Generate subscription plan description using backend (OpenAI key on server)
   */
  async generateSubscriptionPlanDescription(data: {
    name?: string;
    monthlyPrice?: number | string;
    isSponsor?: boolean;
    planBenefits?: string[];
    annualPrice?: number | string;
  }): Promise<string> {
    try {
      const { name, monthlyPrice, isSponsor, planBenefits, annualPrice } = data;

      const prompt = `Generate a compelling and engaging description for a subscription plan${name ? ` named "${name}"` : ''}${monthlyPrice && monthlyPrice !== '0' ? ` priced at $${monthlyPrice}/month` : ''}${annualPrice && annualPrice !== '0' ? ` (or $${annualPrice}/year with discount)` : ''}${isSponsor ? ' (Sponsor plan)' : ' (Event plan)'}. ${planBenefits && planBenefits.length > 0 ? `The plan includes benefits like: ${planBenefits.filter((b) => b && b.trim() !== '').join(', ')}. ` : ''}Make it concise (3-4 paragraphs), highlight the value proposition, and include 2-3 relevant emoji's. Focus on why subscribers should join and what they'll gain.`;

      const messages: OpenAIMessage[] = [{ role: 'user', content: prompt }];
      return await this.generateDescription(messages, 500);
    } catch (error: any) {
      console.error('Error generating subscription plan description:', error);
      throw error;
    }
  }

  /**
   * Generate user profile "About Me" description using backend (OpenAI key on server)
   */
  async generateUserProfileDescription(data: any): Promise<string> {
    try {
      const promptParts: string[] = [];
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
      if (fullName) promptParts.push(`name=${fullName}`);
      if (data.accountType) promptParts.push(`accountType=${data.accountType}`);
      if (data.companyName) promptParts.push(`companyName=${data.companyName}`);
      if (data.collegeUniversity) promptParts.push(`education=${data.collegeUniversity}`);
      if (data.address) promptParts.push(`address=${data.address}`);

      const prompt = `
Generate a concise and engaging "About Me" profile description written STRICTLY in FIRST PERSON.

The description must sound like the user is talking about themselves.

Use ONLY the following details:
${promptParts.join('; ')}.

Rules:
- ALWAYS use first-person language (I, I am, I'm, my)
- NEVER use third-person words (he, she, they, his, her)
- Do NOT invent any information
- If a value is missing, leave it out completely
- Use 1–2 relevant emojis
- Keep it short, clean, and readable
- Use short paragraphs
`;

      const messages: OpenAIMessage[] = [{ role: 'user', content: prompt }];
      const description = await this.generateDescription(messages, 400);
      return description.trim();
    } catch (error: any) {
      console.error('Error generating user profile description:', error);
      throw error;
    }
  }
}
