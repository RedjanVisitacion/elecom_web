from django.urls import path

from . import views

urlpatterns = [
    path("api/login/", views.api_login, name="api_login"),
    path("api/logout/", views.api_logout, name="api_logout"),
    path("api/me/", views.dashboard_view, name="api_me"),
]
