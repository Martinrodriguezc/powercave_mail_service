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
    clientId?: number; // Opcional para correos de prueba
}

export interface DiscountMail extends Mail  {
    userName: string;
    promotionEndDate: string;
}