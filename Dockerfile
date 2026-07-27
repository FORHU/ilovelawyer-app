#Base
FROM node:22-alpine AS base
# Set the working directory
WORKDIR /app
# Enable corepack to manage package managers like pnpm. Corepack is a tool that allows you to use different package managers in a consistent way, ensuring that the correct version of the package manager is used for your project.
RUN corepack enable

# Dependencies
FROM base AS dependencies
# libc6-compat is required for the standalone output of next.js and for compatibility and performance reasons, it's recommended to use the alpine version of node which is based on musl libc. However, some packages may require glibc, and libc6-compat provides a compatibility layer for that.
RUN apk add --no-cache libc6-compat 

# Copy the package.json, pnpm-lock.yaml, and pnpm-workspace.yaml files to the working directory. These files define the dependencies and configuration for the project, allowing pnpm to install the required packages and ensure that the correct versions are used.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/

# Install the dependencies using pnpm. The corepack enable command enables the use of package managers like pnpm, and the corepack prepare command prepares the specified version of pnpm for use. The --activate flag activates the specified version, and the pnpm install command installs the dependencies defined in the package.json file, ensuring that the versions match those specified in the pnpm-lock.yaml file. The --frozen-lockfile flag ensures that the lockfile is not modified during installation, providing a consistent and reproducible environment.
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate && pnpm install --frozen-lockfile

# Used to compile the application and generate the production-ready output. This stage is responsible for building the application using the dependencies installed in the previous stage. It copies the source code and configuration files into the container, runs the build command, and produces the optimized output that can be served in a production environment.
FROM base AS builder

# Copy the source code and configuration files
COPY . .

# Install the dependencies using pnpm. The --frozen-lockfile flag ensures that the lockfile is not modified during installation, providing a consistent and reproducible environment.
RUN pnpm install --frozen-lockfile

# Build the application
RUN pnpm run build

# Run the application in a production environment. This stage is responsible for running the application in a production environment. It sets the NODE_ENV environment variable to production, which enables optimizations and disables development-specific features. The application can then be started using the appropriate command, such as npm start or node server.js, depending on the framework and setup.
FROM base AS runner
ENV NODE_ENV=production

# Create a non-root user and group for running the application. This is a security best practice to avoid running the application as the root user, which can pose security risks. By creating a dedicated user and group, we can limit the permissions and access of the application, reducing the potential impact of any security vulnerabilities.
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the necessary files from the builder stage to the runner stage. This includes the public directory, which contains static assets, and the standalone output of the Next.js application, which includes the server.js file and other necessary files for running the application in a production environment. The .next/static directory is also copied to ensure that any static assets generated during the build process are available in the production environment.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Set the ownership of the application files to the non-root user and group. This ensures that the application files are owned by the nextjs user and nodejs group, preventing unauthorized access or modifications by other users in the container.
USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

# Start the application using the appropriate command. In this case, we are using the node command to run the server.js file, which is the entry point of the Next.js application. This command will start the application and make it accessible on the specified port.
CMD ["node", "apps/web/server.js"]

# docker build -t ilovelawyer-app .