FROM golang:1.24.9-bookworm AS build

ENV GOTOOLCHAIN=local \
    CGO_ENABLED=0

WORKDIR /src

RUN git init . \
    && git remote add origin https://github.com/minio/minio.git \
    && git fetch --depth=1 origin 7aac2a2c5b7c882e68c1ce017d8256be2feea27f \
    && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "7aac2a2c5b7c882e68c1ce017d8256be2feea27f"

RUN go mod download && go mod verify
RUN go build -p 2 -trimpath -o /out/minio .

FROM debian:bookworm-slim

COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/minio /usr/local/bin/minio
COPY --from=build /src/LICENSE /usr/share/licenses/minio/LICENSE

RUN groupadd --gid 10001 sge \
    && useradd --uid 10001 --gid 10001 --create-home sge \
    && mkdir /data \
    && chown 10001:10001 /data

USER 10001:10001

EXPOSE 9000 9001

ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]