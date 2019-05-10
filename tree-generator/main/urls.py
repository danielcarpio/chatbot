from django.urls import path
from .views import Tree

urlpatterns = [
    path('', Tree.as_view())
]