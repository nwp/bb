VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X github.com/nwp/bb/cmd.version=$(VERSION)
BINARY  := bb

.PHONY: build build-all test vet clean install

build:
	go build -ldflags "$(LDFLAGS)" -o $(BINARY) .

build-all:
	GOOS=darwin  GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o dist/bb-darwin-arm64 .
	GOOS=darwin  GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/bb-darwin-amd64 .
	GOOS=linux   GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o dist/bb-linux-arm64  .
	GOOS=linux   GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/bb-linux-amd64  .

test:
	go test ./...

vet:
	go vet ./...

install: build
	cp $(BINARY) $(GOBIN)/bb

clean:
	rm -f $(BINARY)
	rm -rf dist/
