CREATE TYPE "public"."advisor_message_role" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "public"."pending_proposal_kind" AS ENUM('create_rule', 'recategorize');--> statement-breakpoint
CREATE TYPE "public"."pending_proposal_status" AS ENUM('pending', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "advisor_conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "advisor_message_role" NOT NULL,
	"content_text" text,
	"tool_calls" jsonb,
	"tool_results" jsonb,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisor_message_id" uuid NOT NULL,
	"kind" "pending_proposal_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "pending_proposal_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "advisor_message_id" uuid;--> statement-breakpoint
ALTER TABLE "advisor_conversation" ADD CONSTRAINT "advisor_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_message" ADD CONSTRAINT "advisor_message_conversation_id_advisor_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."advisor_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_proposal" ADD CONSTRAINT "pending_proposal_advisor_message_id_advisor_message_id_fk" FOREIGN KEY ("advisor_message_id") REFERENCES "public"."advisor_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_message_conversation_id_created_at_idx" ON "advisor_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "pending_proposal_status_created_at_idx" ON "pending_proposal" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_advisor_message_id_advisor_message_id_fk" FOREIGN KEY ("advisor_message_id") REFERENCES "public"."advisor_message"("id") ON DELETE set null ON UPDATE no action;