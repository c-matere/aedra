export function getWhatsAppInviteLink(phone: string, companyName: string, inviteToken: string) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const inviteUrl = `${baseUrl}/invite/${inviteToken}`;
    const message = `Hello! You have been invited to join ${companyName} on Aedra. Click the link below to set up your account:\n\n${inviteUrl}`;

    // Remove non-numeric characters from phone
    const cleanPhone = phone.replace(/\D/g, "");

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
