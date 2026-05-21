CREATE TYPE "public"."goal_kind" AS ENUM('cash_target', 'emergency_fund', 'debt_payoff', 'portfolio_target');--> statement-breakpoint
CREATE TABLE "goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "goal_kind" NOT NULL,
	"target_amount" integer NOT NULL,
	"target_date" date,
	"linked_account_ids" uuid[] DEFAULT ARRAY[]::uuid[] NOT NULL,
	"initial_balance" integer,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_user_id_idx" ON "goal" USING btree ("user_id");