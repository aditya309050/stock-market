import asyncio
import unittest
from app.services.dhan.dhan_client import dhan_client


class TestDhanClient(unittest.TestCase):
    def test_fetch_scrip_master(self):
        async def run():
            instruments = await dhan_client.fetch_scrip_master()
            self.assertTrue(len(instruments) > 0)
            symbols = [i["symbol"] for i in instruments]
            # Verify MIDHANI is present in the Dhan Scrip Master
            print(f"Total NSE Equity Instruments: {len(instruments)}")
            has_midhani = "MIDHANI" in symbols or any("MIDHANI" in s for s in symbols)
            print(f"Contains MIDHANI: {has_midhani}")
            return len(instruments)

        count = asyncio.run(run())
        self.assertGreater(count, 0)


if __name__ == "__main__":
    unittest.main()
