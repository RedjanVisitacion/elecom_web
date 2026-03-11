from django.contrib import admin
from django.urls import path
from .views import admin_dashboard_api, login_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', login_view, name='login'), # Access at 127.0.0.1:8000/login/
    path('api/admin/dashboard/', admin_dashboard_api, name='admin_dashboard_api'),
]