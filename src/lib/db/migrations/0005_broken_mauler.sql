CREATE TYPE "public"."frequency" AS ENUM('weekly', 'fortnightly', 'monthly');--> statement-breakpoint
CREATE TABLE "recurring_dismissal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"detection_key" text,
	"name" text NOT NULL,
	"frequency" "frequency" NOT NULL,
	"amount_native" bigint NOT NULL,
	"currency" text NOT NULL,
	"category_id" uuid,
	"next_due" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_dismissal" ADD CONSTRAINT "recurring_dismissal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_subscription" ADD CONSTRAINT "recurring_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_subscription" ADD CONSTRAINT "recurring_subscription_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_dismissal_user_id_key_idx" ON "recurring_dismissal" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "recurring_subscription_user_id_idx" ON "recurring_subscription" USING btree ("user_id");