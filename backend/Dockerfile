FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN chmod +x mvnw && ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre
COPY --from=build /app/target/*.jar /app.jar
ENV SERVER_PORT=8080
CMD ["sh", "-c", "java -Xmx300m -jar /app.jar --server.port=${PORT:-8080}"]
