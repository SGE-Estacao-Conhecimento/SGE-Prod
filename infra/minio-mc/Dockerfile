FROM golang:1.24.9-bookworm AS build

ENV GOTOOLCHAIN=local \
    CGO_ENABLED=0

WORKDIR /src

RUN git init . \
    && git remote add origin https://github.com/minio/mc.git \
    && git fetch --depth=1 origin 77f82e18b5401a65958f1619df6ebb994634bd88 \
    && git checkout --detach FETCH_HEAD \
    && test "$(git rev-parse HEAD)" = "77f82e18b5401a65958f1619df6ebb994634bd88"

RUN go mod download && go mod verify
RUN go build -p 2 -trimpath -o /out/mc .

FROM debian:bookworm-slim

COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/mc /usr/local/bin/mc
COPY --from=build /src/LICENSE /usr/share/licenses/mc/LICENSE

ENV MC_CONFIG_DIR=/tmp/mc

ENTRYPOINT ["mc"]