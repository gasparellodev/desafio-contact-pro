"""Importa todos os models para que SQLModel.metadata enxergue ao gerar migrations."""

from sqlmodel import SQLModel  # noqa: F401

# As importações de modelos serão adicionadas pelo PR #5.
