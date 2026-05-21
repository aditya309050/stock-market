from pydantic import BaseModel

class WatchlistBase(BaseModel):
    symbol: str

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistUpdate(WatchlistBase):
    pass

class Watchlist(WatchlistBase):
    id: int
    owner_id: int

    model_config = {"from_attributes": True}
