export declare class EmailService {
    private transporter;
    private readonly logger;
    private useSendGrid;
    constructor();
    private verifyConnection;
    sendPasswordResetEmail(email: string, code: string, userName?: string): Promise<boolean>;
    private getPasswordResetEmailTemplate;
}
