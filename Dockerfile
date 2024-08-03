# Use an official Node.js LTS base image
FROM node:lts

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive

# Create app directory
WORKDIR /usr/src/app

# Copy project files
COPY . .

# Install project dependencies
RUN npm install

# Build the project
RUN npx prisma generate && npx prisma migrate dev

RUN npx tsc --noEmit


# Expose the port the app runs on
EXPOSE 2000

# Define the command to run the application
CMD ["npm", "run", "start"]