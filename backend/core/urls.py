from django.contrib import admin
from django.urls import path
from .views import login_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('login/', login_view, name='login'), # Access at 127.0.0.1:8000/login/
]