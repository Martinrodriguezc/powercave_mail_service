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
}
