export interface Mail {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

export interface ReminderMail extends Mail {
    userName: string;
    planName: string;
    expiryDate: string;
    clientId?: number;
}

export interface DiscountMail extends Mail {
    userName: string;
    promotionEndDate: string;
}

export interface AdminRenewalReportMail extends Mail {
    expiringSoon: {
        userName: string;
        planName: string;
        expiryDate: string;
    }[];

    recentlyExpired: {
        userName: string;
        planName: string;
        expiryDate: string;
    }[];

    reportDate?: string;
}
