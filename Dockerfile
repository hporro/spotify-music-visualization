# Stage 1: Build the Angular frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --configuration production

# Stage 2: Build the Spring Boot backend
FROM maven:3.9.6-eclipse-temurin-21-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/pom.xml ./
# Pre-download dependencies to speed up subsequent builds
RUN mvn dependency:go-offline
COPY backend/src ./src
# Copy compiled static assets from stage 1 into Spring Boot resources
COPY --from=frontend-builder /app/frontend/dist/frontend/browser ./src/main/resources/static/
RUN mvn clean package -DskipTests

# Stage 3: Lightweight execution runner
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=backend-builder /app/backend/target/visualizer-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
