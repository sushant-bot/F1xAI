from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional, TypeVar

T = TypeVar("T")


class TTLCache:
    """Simple in-memory TTL cache."""
    
    def __init__(self, ttl_seconds: int = 3600):
        self.ttl_seconds = ttl_seconds
        self.cache: Dict[str, tuple[Any, datetime]] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired."""
        if key not in self.cache:
            return None
        
        value, timestamp = self.cache[key]
        if datetime.now() - timestamp > timedelta(seconds=self.ttl_seconds):
            del self.cache[key]
            return None
        
        return value
    
    def set(self, key: str, value: Any) -> None:
        """Set value in cache with timestamp."""
        self.cache[key] = (value, datetime.now())
    
    def delete(self, key: str) -> None:
        """Delete value from cache."""
        if key in self.cache:
            del self.cache[key]
    
    def clear(self) -> None:
        """Clear all cache."""
        self.cache.clear()
    
    def cached(self, key_builder: Callable[..., str], ttl_seconds: Optional[int] = None):
        """Decorator for caching function results."""
        def decorator(func: Callable[..., T]) -> Callable[..., T]:
            def wrapper(*args, **kwargs) -> T:
                cache_key = key_builder(*args, **kwargs)
                cached_value = self.get(cache_key)
                
                if cached_value is not None:
                    return cached_value
                
                result = func(*args, **kwargs)
                self.set(cache_key, result)
                return result
            
            return wrapper
        return decorator


# Global cache instance
session_cache = TTLCache(ttl_seconds=3600)
