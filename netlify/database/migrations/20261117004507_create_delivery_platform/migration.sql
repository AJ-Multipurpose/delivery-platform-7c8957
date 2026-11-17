CREATE TABLE "disputes" (
	"id" serial PRIMARY KEY,
	"order_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL UNIQUE,
	"mime" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"order_id" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"user_id" text PRIMARY KEY,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"dob" text NOT NULL,
	"address" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"background_passed" boolean DEFAULT false NOT NULL,
	"online" boolean DEFAULT false NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"position_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" serial PRIMARY KEY,
	"recipient" text NOT NULL,
	"event" text NOT NULL,
	"order_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"kind" text NOT NULL,
	"reference" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"customer_id" text NOT NULL,
	"shop_id" integer NOT NULL,
	"driver_id" text,
	"status" text DEFAULT 'placed' NOT NULL,
	"items" jsonb NOT NULL,
	"subtotal" integer NOT NULL,
	"delivery_fee" integer DEFAULT 2000 NOT NULL,
	"commission_rate" integer NOT NULL,
	"address" text NOT NULL,
	"notes" text,
	"lat" double precision,
	"lng" double precision,
	"proof_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"picked_up_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"idempotency_key" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"sw" text NOT NULL,
	"price" integer NOT NULL,
	"old_price" integer,
	"unit" text NOT NULL,
	"category" text NOT NULL,
	"image" text,
	"sku" text UNIQUE,
	"stock" integer DEFAULT 0 NOT NULL,
	"available" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"order_id" integer PRIMARY KEY,
	"user_id" text NOT NULL,
	"stars" integer NOT NULL,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"user_id" text PRIMARY KEY,
	"role" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY,
	"owner_id" text UNIQUE,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"address" text NOT NULL,
	"phone" text,
	"description" text,
	"hours" text,
	"image" text,
	"cuisine" text,
	"lat" double precision,
	"lng" double precision,
	"status" text DEFAULT 'pending' NOT NULL,
	"commission" integer DEFAULT 10 NOT NULL,
	"proposed_commission" integer
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_event_order" ON "email_outbox" ("event","order_id");--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_profiles_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_drivers_user_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("user_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id");--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_profiles_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id");--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_profiles_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id");