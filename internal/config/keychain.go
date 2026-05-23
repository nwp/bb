package config

import (
	"github.com/zalando/go-keyring"
)

const keychainService = "bb-cli"

// keychainStore implements TokenStore using the system keyring via go-keyring.
type keychainStore struct{}

func (k *keychainStore) Get(hostname string) (string, error) {
	return keyring.Get(keychainService, hostname)
}

func (k *keychainStore) Set(hostname, token string) error {
	return keyring.Set(keychainService, hostname, token)
}

func (k *keychainStore) Delete(hostname string) error {
	return keyring.Delete(keychainService, hostname)
}
