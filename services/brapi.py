"""Serviço para integração com a API BRAPI."""


class BrapiService:
    def __init__(self):
        self.base_url = "https://brapi.dev/api"

    def get_quote(self, ticker: str):
        """Retorna dados de cotação para um ativo."""
        pass
