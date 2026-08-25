# Trivara Stays Email Notification Functions

This directory contains Supabase Edge Functions for sending transactional emails using Resend.

## Functions

### 1. sendBookingConfirmationEmail
Sends booking confirmation emails to both guest and host when a booking is created.

**Trigger:** Call after booking creation in `bookingService.create()`

**Parameters:**
```json
{
  "booking_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "guestEmailId": "resend-email-id",
  "hostEmailId": "resend-email-id"
}
```

### 2. sendBookingCancellationEmail
Sends booking cancellation emails to both guest and host when a booking is cancelled.

**Trigger:** Call after booking cancellation in `bookingService.cancelBooking()`

**Parameters:**
```json
{
  "booking_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "guestEmailId": "resend-email-id",
  "hostEmailId": "resend-email-id"
}
```

### 3. sendPayoutRequestEmail
Sends payout request notification email to admin when a host requests a payout.

**Trigger:** Call after payout request creation in `payoutService.requestPayout()`

**Parameters:**
```json
{
  "payout_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "emailId": "resend-email-id"
}
```

## Deployment Instructions

### 1. Set Environment Variables
First, set the required environment variables in your Supabase project:

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key_here
supabase secrets set ADMIN_EMAIL=admin@yourdomain.com
```

### 2. Deploy Functions
Deploy each function individually:

```bash
supabase functions deploy sendBookingConfirmationEmail
supabase functions deploy sendBookingCancellationEmail
supabase functions deploy sendPayoutRequestEmail
```

### 3. Configure Database Triggers (Optional)
You can set up PostgreSQL triggers to automatically call these functions:

```sql
-- Trigger for booking confirmation
CREATE OR REPLACE FUNCTION notify_booking_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  SELECT supabase_functions.http_post(
    'https://your-project.supabase.co/functions/v1/sendBookingConfirmationEmail',
    json_build_object('booking_id', NEW.id)::text,
    json_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_confirmation_trigger
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_confirmation();
```

## Integration with Application Services

### Booking Service Integration

**In `bookingService.create()`:**
```typescript
// After successful booking creation
const { data, error } = await supabase.functions.invoke('sendBookingConfirmationEmail', {
  body: { booking_id: bookingData.id }
});
```

**In `bookingService.cancelBooking()`:**
```typescript
// After successful booking cancellation
const { data, error } = await supabase.functions.invoke('sendBookingCancellationEmail', {
  body: { booking_id: bookingId }
});
```

### Payout Service Integration

**In `payoutService.requestPayout()`:**
```typescript
// After successful payout request creation
const { data, error } = await supabase.functions.invoke('sendPayoutRequestEmail', {
  body: { payout_id: payoutData.id }
});
```

## Email Templates

All emails use clean, professional HTML templates with:
- Responsive design
- Consistent branding
- Proper Indian currency formatting (₹)
- Clear information hierarchy
- Mobile-friendly layouts

## Testing

Test functions locally using the Supabase CLI:

```bash
supabase functions serve sendBookingConfirmationEmail
```

Then call the function:
```bash
curl -X POST http://localhost:54321/functions/v1/sendBookingConfirmationEmail \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"booking_id": "test-booking-id"}'
```

## Error Handling

All functions include proper error handling and will:
- Return appropriate HTTP status codes
- Log errors to Supabase logs
- Provide meaningful error messages
- Not expose sensitive information

## Security

- Functions use service role keys for database access
- Environment variables store sensitive credentials
- CORS headers configured for security
- Input validation for all parameters