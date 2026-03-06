import { IUser } from './IUser';

export type RSVPStatus = 'Yes' | 'Maybe' | 'No' | (string & {});

export type OrderDirection = 'ASC' | 'DESC';

export interface IPagination {
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface IListParamsBase {
  page?: number;
  limit?: number;
  search?: string;
  order_by?: string;
  order_direction?: OrderDirection;
}

export interface IEventAttendeeTicket {
  id?: string;
  name?: string;
  ticket_type?: string;
}

export interface IEventAttendee {
  id: string;
  event_id?: string;
  user_id?: string;
  parent_user_id?: string | null;

  name?: string;
  is_incognito?: boolean;
  rsvp_status?: RSVPStatus;
  is_checked_in?: boolean;

  event_ticket_id?: string;
  amount_paid?: number;
  platform_fee_amount?: number;
  host_payout_amount?: number;
  created_at?: string;

  user?: IUser;
  event_ticket?: IEventAttendeeTicket;
  payment_status?: string | null;
  payment_mode?: string | null;
}

export interface IGetEventAttendeesParams extends IListParamsBase {
  rsvp_status?: RSVPStatus;
  is_checked_in?: boolean;
  ticket_type?: string;
  is_connected?: boolean;
}

export interface IGetEventAttendeesListParams extends IListParamsBase {
  order_by?: 'name' | 'created_at';
  rsvp_status?: RSVPStatus;
}

export interface IEventAttendeesSummary {
  total_yes_guest: number;
  total_maybe_guest: number;
  total_no_guest: number;
}

export interface IEventAttendeesCounts {
  total_guest: number;
  total_attending_guest: number;
  total_maybe_guest: number;
  total_no_guest: number;
  total_checkedin_guest: number;
}

export interface IGetEventAttendeesListResult {
  data: IEventAttendee[];
  pagination: IPagination;
  summary?: IEventAttendeesSummary;
}

export interface IGetEventAttendeesResult {
  data: IEventAttendee[];
  pagination: IPagination;
  counts?: IEventAttendeesCounts;
}

export type EventParticipantRole = 'Host' | 'CoHost' | 'Sponsor' | 'Speaker' | (string & {});

export interface IEventParticipant {
  id: string;
  role?: EventParticipantRole;
  user?: IUser;
}

export interface IGetEventParticipantsListParams extends IListParamsBase {
  role?: EventParticipantRole;
  order_by?: 'name' | 'role' | 'created_at';
}

export interface IGetEventParticipantsListResult {
  data: IEventParticipant[];
  pagination: IPagination;
}
export interface IRefundAttendeeResponse {
  success: boolean;
  message: string;
  data: IEventAttendee;
}

export interface IGuestFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  ticketType: string | null;
  paymentMethod: 'Cash' | 'InApp';
  markAsPaid: boolean;
  sendPaymentLink: boolean;
}

export interface IAddGuestAttendeePayload {
  name: string;
  email: string;
  event_ticket_id: string;
  platform_fee_amount: number;
  amount_paid: number;
  host_payout_amount: number;
  payment_mode: 'cash' | 'in-app';
  is_paid: boolean;
  send_link: boolean;
}

export interface IAddGuestPayload {
  event_id: string;
  attendee: IAddGuestAttendeePayload;
}

export interface IAddGuestResponse {
  success: boolean;
  message: string;
  data: {
    content: IEventAttendee;
    payment_link: string | null;
  };
}

export interface IMarkAsPaidResponse {
  success: boolean;
  message: string;
  data: IEventAttendee;
}
