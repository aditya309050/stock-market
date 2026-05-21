class RiskService:
    def calculate_position_size(self, account_balance: float, risk_percentage: float, entry_price: float, stop_loss: float) -> float:
        """
        Calculate how many shares to buy based on risk parameters.
        """
        if entry_price <= stop_loss:
            raise ValueError("Entry price must be greater than stop loss for a long position.")
            
        risk_amount = account_balance * (risk_percentage / 100)
        risk_per_share = entry_price - stop_loss
        
        return risk_amount / risk_per_share

    def risk_reward_ratio(self, entry_price: float, stop_loss: float, target_price: float) -> float:
        risk = entry_price - stop_loss
        reward = target_price - entry_price
        if risk <= 0:
            return 0.0
        return reward / risk

risk_service = RiskService()
