# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app

# Vite bakes VITE_* variables into the client bundle at BUILD time, not at
# container start time - so they must arrive as build args here, not as
# `environment:` entries on a running container. See docker-compose.yml.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_RAZORPAY_KEY_ID
ARG VITE_ADMIN_EMAIL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID \
    VITE_ADMIN_EMAIL=$VITE_ADMIN_EMAIL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
