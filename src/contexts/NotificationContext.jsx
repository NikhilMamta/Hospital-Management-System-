import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success', // 'success' | 'error' | 'info'
        duration: 1000
    });

    const hideNotification = useCallback(() => {
        setNotification(prev => ({ ...prev, show: false }));
    }, []);

    const showNotification = useCallback((message, type = 'success') => {
        setNotification({
            show: true,
            message,
            type,
            duration: 1000 // Enforce 1 second globally
        });
    }, []);

    useEffect(() => {
        if (notification.show && notification.duration > 0) {
            const timer = setTimeout(() => {
                hideNotification();
            }, notification.duration);
            return () => clearTimeout(timer);
        }
    }, [notification.show, notification.duration, hideNotification]);

    return (
        <NotificationContext.Provider value={{ showNotification, hideNotification }}>
            {children}

            {/* Global Notification Popup */}
            {notification.show && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm bg-black/10">
                    <div className="relative w-full max-w-md transform transition-all duration-300 animate-scale-in">
                        <div className={`rounded-xl shadow-2xl overflow-hidden border-2 ${notification.type === 'success'
                            ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
                            : notification.type === 'error'
                                ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
                                : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
                            }`}>
                            <div className="p-6 text-center">
                                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${notification.type === 'success' ? 'bg-green-100' :
                                    notification.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
                                    } shadow-inner`}>
                                    {notification.type === 'success' ? (
                                        <CheckCircle className="w-8 h-8 text-green-600" />
                                    ) : notification.type === 'error' ? (
                                        <XCircle className="w-8 h-8 text-red-600" />
                                    ) : (
                                        <Info className="w-8 h-8 text-blue-600" />
                                    )}
                                </div>
                                <h3 className={`text-xl font-bold mb-2 ${notification.type === 'success' ? 'text-green-800' :
                                    notification.type === 'error' ? 'text-red-800' : 'text-blue-800'
                                    }`}>
                                    {notification.type === 'success' ? 'Success!' :
                                        notification.type === 'error' ? 'Error!' : 'Notice'}
                                </h3>
                                <p className={`text-sm font-medium leading-relaxed ${notification.type === 'success' ? 'text-green-700' :
                                    notification.type === 'error' ? 'text-red-700' : 'text-blue-700'
                                    }`}>
                                    {notification.message}
                                </p>

                                {/* Progress Bar */}
                                <div className={`mt-6 h-1.5 w-full rounded-full overflow-hidden ${notification.type === 'success' ? 'bg-green-200' :
                                    notification.type === 'error' ? 'bg-red-200' : 'bg-blue-200'
                                    }`}>
                                    <div
                                        className={`h-full ${notification.type === 'success' ? 'bg-green-500' :
                                            notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                            } animate-progress`}
                                        style={{ animationDuration: `${notification.duration}ms` }}
                                    ></div>
                                </div>

                                <button
                                    onClick={hideNotification}
                                    className="mt-6 px-6 py-2 rounded-lg bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                
                @keyframes progress {
                    from {
                        width: 100%;
                    }
                    to {
                        width: 0%;
                    }
                }
                
                .animate-scale-in {
                    animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                
                .animate-progress {
                    animation: progress linear forwards;
                }
            `}</style>
        </NotificationContext.Provider>
    );
};
