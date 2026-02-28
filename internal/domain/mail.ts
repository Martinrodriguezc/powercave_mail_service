export interface Mail {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    logoUrl?: string | null;
    gymName?: string | null;
}

export interface ReminderMail extends Mail {
    userName: string;
    planName: string;
    expiryDate: string;
    publicId?: string;
    gymName?: string;
    logoUrl?: string | null;
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
    gymName?: string;
    logoUrl?: string | null;
}

export interface DailySalesReportMail extends Mail {
    reportDate: string;
    gymName?: string;
    logoUrl?: string | null;
    totalRevenue: number;
    planSales: {
        sales: {
            clientName: string;
            planName: string;
            amount: number;
            time: string;
        }[];
        totalAmount: number;
    };
    foodSales: {
        sales: {
            clientName: string;
            foodName: string;
            amount: number;
            time: string;
        }[];
        totalAmount: number;
    };
    merchandiseSales: {
        sales: {
            clientName: string;
            productName: string;
            amount: number;
            time: string;
        }[];
        totalAmount: number;
    };
}

export interface PasswordResetMail extends Mail {
    resetLink: string;
    gymName?: string;
    logoUrl?: string | null;
}

export interface PlatformUserCredentialsMail extends Mail {
    temporaryPassword: string;
    gymName: string | null;
    resetPasswordLink: string;
    logoUrl?: string | null;
}

export interface ReminderReportResult {
    publicId: string | null;
    email: string;
    status: 'success' | 'failed' | 'skipped';
    error: string | null;
    reason: string | null; // Razón por la que no se envió (error, o "Ya se envió en las últimas 48 horas")
}
