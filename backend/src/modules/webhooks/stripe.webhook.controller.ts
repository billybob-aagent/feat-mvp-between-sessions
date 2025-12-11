import { Controller, Headers, HttpCode, Post, Req, Res } from '@nestjs/common';
import Stripe from 'stripe';
import type { Request, Response } from 'express';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

  @Post()
  @HttpCode(200)
  handle(@Req() req: Request, @Res() res: Response, @Headers('stripe-signature') signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) return res.status(500).send('Webhook secret missing');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent((req as any).rawBody || (req as any).body, signature, endpointSecret);
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
      case 'invoice.payment_succeeded':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // TODO: enqueue job for async processing
        break;
      default:
        break;
    }

    return res.json({ received: true });
  }
}
