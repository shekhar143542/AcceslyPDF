CREATE TABLE "pdf_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pdf_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"report_url" text,
	"raw_report" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pdfs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer NOT NULL,
	"upload_status" varchar(50) DEFAULT 'uploaded' NOT NULL,
	"accessibility_score" integer,
	"prep_source_id" text,
	"analysis_status" varchar(50),
	"report_url" text,
	"raw_report" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pdf_analyses" ADD CONSTRAINT "pdf_analyses_pdf_id_pdfs_id_fk" FOREIGN KEY ("pdf_id") REFERENCES "public"."pdfs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pdf_analyses_pdf_id_idx" ON "pdf_analyses" USING btree ("pdf_id");--> statement-breakpoint
CREATE INDEX "pdf_analyses_source_id_idx" ON "pdf_analyses" USING btree ("source_id");